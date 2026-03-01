import { describe, expect, it } from 'vitest'
import type { RefreshResult, ServerRequestContext } from '../../../utils/request/types'

describe('utils/request/types (unit)', () => {
  it('keeps RefreshResult and ServerRequestContext runtime-compatible shapes', () => {
    const refresh: RefreshResult = {
      setCookies: ['token=abc; Path=/; HttpOnly'],
      accessTokenExp: 1714435200000,
    }

    const context: ServerRequestContext = {
      cookieHeader: 'token=abc',
      realIp: '127.0.0.1',
      userAgent: 'vitest',
    }

    expect(refresh.setCookies[0]).toContain('token=abc')
    expect(context.cookieHeader).toBe('token=abc')
  })
})
