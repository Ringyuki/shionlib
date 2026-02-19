import { describe, expect, it } from 'vitest'
import {
  applySetCookiesToCookieHeader,
  decodeJwtLike,
  formatErrors,
  getCookieValueFromHeader,
  resolveRefreshLockKey,
  shouldDeleteCookieFromSetCookie,
  shouldPreRefreshServerCookie,
} from '../../../utils/request/helpers'

const makeJwtLike = (exp: number) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url')
  return `${header}.${payload}.signature`
}

describe('utils/request/helpers (integration)', () => {
  it('applySetCookiesToCookieHeader should upsert and delete cookies', () => {
    const initialHeader = 'theme=dark; shionlib_refresh_token=old-refresh'
    const setCookies = [
      'theme=; Max-Age=0; Path=/',
      'shionlib_refresh_token=new-refresh; HttpOnly; Path=/',
      'shionlib_access_token=new-access; HttpOnly; Path=/',
    ]

    const nextHeader = applySetCookiesToCookieHeader(initialHeader, setCookies)

    expect(nextHeader).toContain('shionlib_refresh_token=new-refresh')
    expect(nextHeader).toContain('shionlib_access_token=new-access')
    expect(getCookieValueFromHeader(nextHeader, 'theme')).toBeUndefined()
  })

  it('shouldPreRefreshServerCookie should refresh only when token is near expiry', () => {
    const now = Math.floor(Date.now() / 1000)
    const farExp = makeJwtLike(now + 120)
    const nearExp = makeJwtLike(now + 1)

    const farCookieHeader = `shionlib_refresh_token=refresh-token; shionlib_access_token=${farExp}`
    const nearCookieHeader = `shionlib_refresh_token=refresh-token; shionlib_access_token=${nearExp}`

    expect(shouldPreRefreshServerCookie(farCookieHeader, 5_000)).toBe(false)
    expect(shouldPreRefreshServerCookie(nearCookieHeader, 5_000)).toBe(true)
  })

  it('shouldDeleteCookieFromSetCookie recognizes Max-Age=0 and epoch expiry', () => {
    expect(shouldDeleteCookieFromSetCookie('theme=; Max-Age=0; Path=/', '')).toBe(true)
    expect(
      shouldDeleteCookieFromSetCookie('theme=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/', ''),
    ).toBe(true)
    expect(shouldDeleteCookieFromSetCookie('theme=dark; Path=/', 'dark')).toBe(false)
  })

  it('decodeJwtLike decodes valid token and rejects malformed token', () => {
    const now = Math.floor(Date.now() / 1000)
    const jwtLike = makeJwtLike(now + 60)
    const decoded = decodeJwtLike(jwtLike)

    expect(decoded?.payload?.exp).toBe(now + 60)
    expect(decodeJwtLike('invalid.token')).toBeNull()
  })

  it('resolveRefreshLockKey should derive lock key from refresh cookie', () => {
    const key = resolveRefreshLockKey({
      cookieHeader: 'foo=bar; shionlib_refresh_token=refresh-abcdef-1234567890',
    })
    expect(key.startsWith('server:')).toBe(true)
  })

  it('formatErrors flattens field errors in API response', () => {
    const msg = formatErrors({
      code: 100101,
      message: 'Validation failed',
      data: {
        errors: [{ field: 'email', messages: ['invalid email'] }],
      },
      requestId: 'req-test',
      timestamp: new Date().toISOString(),
    })
    expect(msg).toContain('Validation failed')
    expect(msg).toContain('invalid email')
    expect(msg).toContain('(100101)')
  })
})
