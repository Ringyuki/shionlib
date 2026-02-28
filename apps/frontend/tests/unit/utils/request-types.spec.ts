import { describe, expect, it } from 'vitest'
import type { RefreshResult, ServerRequestContext } from '../../../utils/request/types'

describe('utils/request/types (unit)', () => {
  it('keeps RefreshResult and ServerRequestContext runtime-compatible shapes', () => {
    const refresh: RefreshResult = {
      setCookies: ['token=abc; Path=/; HttpOnly'],
      session: {
        accessTokenExpiresAt: '2026-02-28T10:00:00.000Z',
        refreshTokenExpiresAt: '2026-03-07T10:00:00.000Z',
      },
    }

    const context: ServerRequestContext = {
      cookieHeader: 'token=abc',
      realIp: '127.0.0.1',
      userAgent: 'vitest',
    }

    expect(refresh.setCookies[0]).toContain('token=abc')
    expect(refresh.session?.accessTokenExpiresAt).toBe('2026-02-28T10:00:00.000Z')
    expect(context.cookieHeader).toBe('token=abc')
  })
})
