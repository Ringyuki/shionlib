import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const intlHandler = vi.fn(() => ({ headers: new Headers() }))
  return {
    intlHandler,
    createMiddleware: vi.fn(() => intlHandler),
  }
})

vi.mock('next-intl/middleware', () => ({
  default: hoisted.createMiddleware,
}))

vi.mock('../../../i18n/routing', () => ({
  routing: {
    locales: ['en', 'zh', 'ja'],
    defaultLocale: 'en',
  },
}))

const encodeJwtSection = (value: Record<string, unknown>) => {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

const buildJwt = (payload: Record<string, unknown>) => {
  return `${encodeJwtSection({ alg: 'HS256', typ: 'JWT' })}.${encodeJwtSection(payload)}.signature`
}

const buildRequest = ({
  accessToken,
  refreshToken,
  url = 'https://example.com/en/game',
}: {
  accessToken?: string
  refreshToken?: string
  url?: string
}) => {
  const cookieParts: string[] = []
  if (accessToken) cookieParts.push(`shionlib_access_token=${accessToken}`)
  if (refreshToken) cookieParts.push(`shionlib_refresh_token=${refreshToken}`)

  const cookieMap = new Map<string, { value: string }>()
  if (accessToken) cookieMap.set('shionlib_access_token', { value: accessToken })
  if (refreshToken) cookieMap.set('shionlib_refresh_token', { value: refreshToken })

  return {
    cookies: {
      get: (key: string) => cookieMap.get(key),
    },
    headers: new Headers({ cookie: cookieParts.join('; ') }),
    url,
  } as any
}

describe('runtime/proxy (unit)', () => {
  beforeEach(() => {
    vi.resetModules()
    hoisted.createMiddleware.mockClear()
    hoisted.intlHandler.mockClear()
    hoisted.intlHandler.mockImplementation(() => ({ headers: new Headers() }))
    vi.stubGlobal('fetch', vi.fn())
  })

  it('does not refresh when access token expiry is far from leeway', async () => {
    const validAccess = buildJwt({ exp: Math.floor((Date.now() + 5 * 60 * 1000) / 1000) })
    const request = buildRequest({ accessToken: validAccess, refreshToken: 'refresh-token' })

    const { default: proxy } = await import('../../../proxy')
    await proxy(request)

    expect(global.fetch).not.toHaveBeenCalled()
    expect(hoisted.intlHandler).toHaveBeenCalledWith(request)
  })

  it('refreshes and appends set-cookie headers when refresh is needed', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      headers: {
        getSetCookie: () => ['access=new-token; Path=/', 'refresh=new-refresh; Path=/'],
        get: () => null,
      },
    })

    const request = buildRequest({ refreshToken: 'refresh-token' })

    const { default: proxy } = await import('../../../proxy')
    const response = await proxy(request)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/api/auth/token/refresh', {
      method: 'POST',
      headers: { cookie: request.headers.get('cookie') || '' },
    })

    const setCookie = response.headers.get('set-cookie') || ''
    expect(setCookie).toContain('access=new-token')
    expect(setCookie).toContain('refresh=new-refresh')
  })

  it('keeps middleware response when refresh request fails', async () => {
    ;(global.fetch as any).mockRejectedValue(new Error('network failed'))
    const request = buildRequest({ refreshToken: 'refresh-token' })

    const { default: proxy } = await import('../../../proxy')
    const response = await proxy(request)

    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('exports matcher config for non-api paths', async () => {
    const { config } = await import('../../../proxy')

    expect(config.matcher).toContain('(?!api|trpc|_next|_vercel|og|patch')
  })
})
