import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLocalStorageMock } from '../_helpers/local-storage'

const ORIGINAL_ENV = { ...process.env }

const loadBrowserRequestModule = async () => {
  vi.resetModules()
  process.env.NEXT_PUBLIC_PROD_API_PATH = 'http://localhost:3000'
  vi.stubGlobal('localStorage', createLocalStorageMock())

  vi.doMock('../../../utils/request/helpers', async () => {
    const actual = await vi.importActual('../../../utils/request/helpers')
    return {
      ...actual,
      isBrowser: true,
      getServerRequestContext: vi.fn(async () => null),
      buildHeaders: vi.fn(async () => ({})),
    }
  })

  const requestModule = await import('../../../utils/request/request')
  const sessionExpiry = await import('../../../utils/auth/session-expiry')
  return {
    ...requestModule,
    ...sessionExpiry,
  }
}

const jsonResponse = (data: unknown) =>
  ({
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify(data),
  }) as Response

describe('utils/request/request browser auth sync (unit)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.resetModules()
    process.env.NEXT_PUBLIC_PROD_API_PATH = ORIGINAL_ENV.NEXT_PUBLIC_PROD_API_PATH
  })

  it('persists auth session expiry from login responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          code: 0,
          message: 'ok',
          data: {
            accessTokenExpiresAt: '2026-02-28T10:00:00.000Z',
            refreshTokenExpiresAt: '2026-03-07T10:00:00.000Z',
          },
          requestId: 'req-1',
          timestamp: '2026-02-28T09:59:00.000Z',
        }),
      ),
    )

    const { shionlibRequest, readAuthSessionExpiry } = await loadBrowserRequestModule()

    await shionlibRequest().post('/user/login', {
      data: { identifier: 'alice', password: 'password123' },
    })

    expect(readAuthSessionExpiry()).toEqual({
      accessTokenExpiresAt: '2026-02-28T10:00:00.000Z',
      refreshTokenExpiresAt: '2026-03-07T10:00:00.000Z',
    })
  })

  it('persists auth session expiry from explicit refresh responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'set-cookie': 'shionlib_access_token=token; Path=/' }),
        json: async () => ({
          code: 0,
          message: 'ok',
          data: {
            accessTokenExpiresAt: '2026-02-28T10:05:00.000Z',
            refreshTokenExpiresAt: '2026-03-07T10:05:00.000Z',
          },
          requestId: 'req-2',
          timestamp: '2026-02-28T10:00:00.000Z',
        }),
      }),
    )

    const { refreshAuthSession, readAuthSessionExpiry } = await loadBrowserRequestModule()

    const result = await refreshAuthSession()

    expect(result.session).toEqual({
      accessTokenExpiresAt: '2026-02-28T10:05:00.000Z',
      refreshTokenExpiresAt: '2026-03-07T10:05:00.000Z',
    })
    expect(readAuthSessionExpiry()).toEqual({
      accessTokenExpiresAt: '2026-02-28T10:05:00.000Z',
      refreshTokenExpiresAt: '2026-03-07T10:05:00.000Z',
    })
  })
})
