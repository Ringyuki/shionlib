import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLocalStorageMock } from '../../unit/_helpers/local-storage'

const ORIGINAL_ENV = { ...process.env }

const loadRequestModule = async (
  env: Partial<
    Record<'INTERNAL_API_BASE_URL' | 'INTERNAL_API_PORT' | 'NEXT_PUBLIC_PROD_API_PATH', string>
  > = {},
) => {
  vi.resetModules()

  process.env.INTERNAL_API_BASE_URL = env.INTERNAL_API_BASE_URL
  process.env.INTERNAL_API_PORT = env.INTERNAL_API_PORT
  process.env.NEXT_PUBLIC_PROD_API_PATH = env.NEXT_PUBLIC_PROD_API_PATH

  vi.stubGlobal('localStorage', createLocalStorageMock())

  vi.doMock('../../../utils/request/helpers', async () => {
    const actual = await vi.importActual('../../../utils/request/helpers')
    return {
      ...actual,
      isBrowser: false,
      getServerRequestContext: vi.fn(async () => null),
      buildHeaders: vi.fn(async () => ({})),
    }
  })

  return await import('../../../utils/request/request')
}

const jsonResponse = (data: unknown, headers?: HeadersInit) =>
  ({
    status: 200,
    headers: new Headers(headers),
    text: async () => JSON.stringify(data),
  }) as Response

describe('utils/request/request (integration)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.resetModules()
    process.env.INTERNAL_API_BASE_URL = ORIGINAL_ENV.INTERNAL_API_BASE_URL
    process.env.INTERNAL_API_PORT = ORIGINAL_ENV.INTERNAL_API_PORT
    process.env.NEXT_PUBLIC_PROD_API_PATH = ORIGINAL_ENV.NEXT_PUBLIC_PROD_API_PATH
  })

  it('throws when API base URL is missing', async () => {
    const { shionlibRequest } = await loadRequestModule({
      INTERNAL_API_BASE_URL: '',
      INTERNAL_API_PORT: '',
      NEXT_PUBLIC_PROD_API_PATH: '',
    })

    await expect(shionlibRequest().get('/health')).rejects.toThrow('API base URL is not configured')
  })

  it('performs GET request and returns successful response body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        code: 0,
        message: 'ok',
        data: { alive: true },
        requestId: 'r1',
        timestamp: new Date().toISOString(),
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { shionlibRequest } = await loadRequestModule({
      INTERNAL_API_BASE_URL: 'http://localhost:3000',
    })

    const res = await shionlibRequest().get<{ alive: boolean }>('/health')
    expect(res.code).toBe(0)
    expect(res.data).toEqual({ alive: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/health',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
  })

  it('serializes POST body and query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        code: 0,
        message: 'ok',
        data: { id: 1 },
        requestId: 'r2',
        timestamp: new Date().toISOString(),
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { shionlibRequest } = await loadRequestModule({
      INTERNAL_API_BASE_URL: 'http://localhost:3000',
    })

    await shionlibRequest().post('/user/login', {
      data: { identifier: 'alice', password: 'pw' },
      params: { from: 'dialog' },
    })

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:3000/user/login?from=dialog')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify({ identifier: 'alice', password: 'pw' }))
  })

  it('returns error payload when forceNotThrowError is enabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          code: 429,
          message: 'Too many requests',
          data: {},
          requestId: 'r3',
          timestamp: new Date().toISOString(),
        }),
      ),
    )

    const { shionlibRequest } = await loadRequestModule({
      INTERNAL_API_BASE_URL: 'http://localhost:3000',
    })

    const res = await shionlibRequest({ forceNotThrowError: true }).get('/search/games')
    expect(res.code).toBe(429)
    expect(res.message).toBe('Too many requests')
  })

  it('throws fatal auth error and triggers logout flow', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          code: 200105,
          message: 'AUTH_FAMILY_BLOCKED',
          data: {},
          requestId: 'r4',
          timestamp: new Date().toISOString(),
        }),
      )
      .mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const { shionlibRequest } = await loadRequestModule({
      INTERNAL_API_BASE_URL: 'http://localhost:3000',
    })

    await expect(shionlibRequest().get('/message/unread')).rejects.toThrow('AUTH_FAMILY_BLOCKED')
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
